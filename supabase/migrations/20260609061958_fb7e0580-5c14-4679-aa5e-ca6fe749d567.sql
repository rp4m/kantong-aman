CREATE TYPE public.budget_status AS ENUM ('draft', 'active', 'closed');
CREATE TYPE public.collab_role AS ENUM ('owner', 'collaborator', 'viewer');
CREATE TYPE public.collab_status AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE public.tx_type AS ENUM ('income', 'expense');
CREATE TYPE public.notif_type AS ENUM (
  'invitation_received','invitation_accepted','transaction_added',
  'budget_updated','collaborator_added','collaborator_removed'
);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_email ON public.profiles (lower(email));
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles select all authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TABLE public.budget_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status public.budget_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_budget_periods_owner ON public.budget_periods (owner_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_periods TO authenticated;
GRANT ALL ON public.budget_periods TO service_role;
ALTER TABLE public.budget_periods ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.budget_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_period_id UUID NOT NULL REFERENCES public.budget_periods(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  role public.collab_role NOT NULL DEFAULT 'collaborator',
  status public.collab_status NOT NULL DEFAULT 'pending',
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_collab_unique ON public.budget_collaborators (budget_period_id, lower(invited_email));
CREATE INDEX idx_collab_user ON public.budget_collaborators (user_id);
CREATE INDEX idx_collab_email ON public.budget_collaborators (lower(invited_email));
CREATE INDEX idx_collab_budget ON public.budget_collaborators (budget_period_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_collaborators TO authenticated;
GRANT ALL ON public.budget_collaborators TO service_role;
ALTER TABLE public.budget_collaborators ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_budget_owner(_budget_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.budget_periods WHERE id = _budget_id AND owner_user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.has_budget_access(_budget_id UUID, _min_role public.collab_role, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH r AS (
    SELECT CASE _min_role WHEN 'viewer' THEN 1 WHEN 'collaborator' THEN 2 WHEN 'owner' THEN 3 END AS need
  ),
  a AS (
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM public.budget_periods WHERE id = _budget_id AND owner_user_id = _user_id) THEN 3
      ELSE COALESCE((
        SELECT CASE role WHEN 'owner' THEN 3 WHEN 'collaborator' THEN 2 WHEN 'viewer' THEN 1 END
        FROM public.budget_collaborators
        WHERE budget_period_id = _budget_id AND user_id = _user_id AND status = 'accepted' LIMIT 1
      ), 0)
    END AS lvl
  )
  SELECT a.lvl >= r.need FROM r, a;
$$;

CREATE POLICY "budgets select if access" ON public.budget_periods FOR SELECT TO authenticated
  USING (public.has_budget_access(id, 'viewer', auth.uid()));
CREATE POLICY "budgets insert as self" ON public.budget_periods FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "budgets update if owner" ON public.budget_periods FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());
CREATE POLICY "budgets delete if owner" ON public.budget_periods FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid());

CREATE POLICY "collab select own or owner" ON public.budget_collaborators FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_budget_owner(budget_period_id, auth.uid()));
CREATE POLICY "collab insert if owner" ON public.budget_collaborators FOR INSERT TO authenticated
  WITH CHECK (public.is_budget_owner(budget_period_id, auth.uid()));
CREATE POLICY "collab update if owner or self" ON public.budget_collaborators FOR UPDATE TO authenticated
  USING (public.is_budget_owner(budget_period_id, auth.uid()) OR user_id = auth.uid())
  WITH CHECK (public.is_budget_owner(budget_period_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "collab delete if owner" ON public.budget_collaborators FOR DELETE TO authenticated
  USING (public.is_budget_owner(budget_period_id, auth.uid()));

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_categories_owner ON public.categories (owner_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories self" ON public.categories FOR ALL TO authenticated
  USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

CREATE TABLE public.pics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pics_owner ON public.pics (owner_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pics TO authenticated;
GRANT ALL ON public.pics TO service_role;
ALTER TABLE public.pics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pics self" ON public.pics FOR ALL TO authenticated
  USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

CREATE TABLE public.budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_period_id UUID NOT NULL REFERENCES public.budget_periods(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  pic_id UUID REFERENCES public.pics(id) ON DELETE SET NULL,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_items_budget ON public.budget_items (budget_period_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_items TO authenticated;
GRANT ALL ON public.budget_items TO service_role;
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "items select viewer" ON public.budget_items FOR SELECT TO authenticated
  USING (public.has_budget_access(budget_period_id, 'viewer', auth.uid()));
CREATE POLICY "items insert owner" ON public.budget_items FOR INSERT TO authenticated
  WITH CHECK (public.is_budget_owner(budget_period_id, auth.uid()));
CREATE POLICY "items update owner" ON public.budget_items FOR UPDATE TO authenticated
  USING (public.is_budget_owner(budget_period_id, auth.uid()))
  WITH CHECK (public.is_budget_owner(budget_period_id, auth.uid()));
CREATE POLICY "items delete owner" ON public.budget_items FOR DELETE TO authenticated
  USING (public.is_budget_owner(budget_period_id, auth.uid()));

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_period_id UUID REFERENCES public.budget_periods(id) ON DELETE CASCADE,
  budget_item_id UUID REFERENCES public.budget_items(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  type public.tx_type NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  date DATE NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tx_budget ON public.transactions (budget_period_id);
CREATE INDEX idx_tx_date ON public.transactions (date);
CREATE INDEX idx_tx_created_by ON public.transactions (created_by);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tx select viewer" ON public.transactions FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR (budget_period_id IS NOT NULL AND public.has_budget_access(budget_period_id, 'viewer', auth.uid())));
CREATE POLICY "tx insert collab" ON public.transactions FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (budget_period_id IS NULL OR public.has_budget_access(budget_period_id, 'collaborator', auth.uid())));
CREATE POLICY "tx update own or owner" ON public.transactions FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR (budget_period_id IS NOT NULL AND public.is_budget_owner(budget_period_id, auth.uid())))
  WITH CHECK (created_by = auth.uid() OR (budget_period_id IS NOT NULL AND public.is_budget_owner(budget_period_id, auth.uid())));
CREATE POLICY "tx delete own or owner" ON public.transactions FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR (budget_period_id IS NOT NULL AND public.is_budget_owner(budget_period_id, auth.uid())));

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.notif_type NOT NULL,
  message TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_user ON public.notifications (user_id, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif select own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif update own" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notif delete own" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

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

CREATE OR REPLACE FUNCTION public.tx_set_updated()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now(); NEW.updated_by = auth.uid(); RETURN NEW;
END;
$$;
CREATE TRIGGER tx_set_updated_trg BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.tx_set_updated();

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
CREATE TRIGGER notify_collab_added_trg AFTER INSERT ON public.budget_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.notify_collab_added();

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
CREATE TRIGGER notify_tx_added_trg AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.notify_tx_added();

REVOKE EXECUTE ON FUNCTION public.is_budget_owner(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_budget_access(UUID, public.collab_role, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tx_set_updated() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_collab_added() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_tx_added() FROM PUBLIC, anon, authenticated;