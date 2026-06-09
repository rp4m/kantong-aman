-- Trigger: Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  ) ON CONFLICT (id) DO NOTHING;

  UPDATE public.budget_collaborators
  SET user_id = NEW.id, status = 'accepted', accepted_at = now()
  WHERE lower(invited_email) = lower(NEW.email) AND status = 'pending';

  INSERT INTO public.notifications (user_id, type, message, payload)
  SELECT bp.owner_user_id, 'invitation_accepted',
         COALESCE(NEW.email,'') || ' menerima undangan ke ' || bp.name,
         jsonb_build_object('budget_id', bp.id, 'user_id', NEW.id)
  FROM public.budget_collaborators bc
  JOIN public.budget_periods bp ON bp.id = bc.budget_period_id
  WHERE bc.user_id = NEW.id AND bc.accepted_at >= now() - interval '5 seconds';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Auto-set updated_at/updated_by on transactions
CREATE OR REPLACE FUNCTION public.tx_set_updated()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now(); NEW.updated_by = auth.uid(); RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tx_set_updated_trg ON public.transactions;
CREATE TRIGGER tx_set_updated_trg BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.tx_set_updated();

-- Trigger: Notify on collaborator added
CREATE OR REPLACE FUNCTION public.notify_collab_added()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name TEXT; v_user UUID;
BEGIN
  SELECT name INTO v_name FROM public.budget_periods WHERE id = NEW.budget_period_id;
  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, message, payload)
    VALUES (NEW.user_id, 'invitation_received', 'Anda diundang ke budget ' || COALESCE(v_name,''),
            jsonb_build_object('budget_id', NEW.budget_period_id, 'role', NEW.role));
  ELSE
    SELECT id INTO v_user FROM public.profiles WHERE lower(email) = lower(NEW.invited_email) LIMIT 1;
    IF v_user IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, message, payload)
      VALUES (v_user, 'invitation_received', 'Anda diundang ke budget ' || COALESCE(v_name,''),
              jsonb_build_object('budget_id', NEW.budget_period_id, 'role', NEW.role));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_collab_added_trg ON public.budget_collaborators;
CREATE TRIGGER notify_collab_added_trg AFTER INSERT ON public.budget_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.notify_collab_added();

-- Trigger: Notify on transaction added
CREATE OR REPLACE FUNCTION public.notify_tx_added()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner UUID; v_name TEXT;
BEGIN
  IF NEW.budget_period_id IS NULL THEN RETURN NEW; END IF;
  SELECT owner_user_id, name INTO v_owner, v_name FROM public.budget_periods WHERE id = NEW.budget_period_id;
  IF v_owner IS NOT NULL AND v_owner <> NEW.created_by THEN
    INSERT INTO public.notifications (user_id, type, message, payload)
    VALUES (v_owner, 'transaction_added', 'Transaksi baru di budget ' || COALESCE(v_name,''),
            jsonb_build_object('budget_id', NEW.budget_period_id, 'transaction_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_tx_added_trg ON public.transactions;
CREATE TRIGGER notify_tx_added_trg AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_tx_added();

-- Trigger: Guard collaborator self-update (prevent privilege escalation)
CREATE OR REPLACE FUNCTION public.tg_collab_self_update_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF app_private.is_budget_owner(NEW.budget_period_id, auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF OLD.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.budget_period_id IS DISTINCT FROM OLD.budget_period_id
     OR NEW.invited_email IS DISTINCT FROM OLD.invited_email THEN
    RAISE EXCEPTION 'collaborators cannot modify role or assignment';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS collab_self_update_guard ON public.budget_collaborators;
CREATE TRIGGER collab_self_update_guard
BEFORE UPDATE ON public.budget_collaborators
FOR EACH ROW EXECUTE FUNCTION public.tg_collab_self_update_guard();

-- Revoke public execute on helper functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tx_set_updated() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_collab_added() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_tx_added() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_collab_self_update_guard() FROM PUBLIC, anon, authenticated;