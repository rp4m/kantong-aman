-- categories: allow read if user is collaborator of a budget that uses this category
CREATE POLICY "collaborators can read categories" ON categories
FOR SELECT USING (
  owner_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM budget_collaborators bc
    JOIN budget_items bi ON bi.budget_period_id = bc.budget_period_id
    WHERE bc.user_id = auth.uid()
    AND bc.status = 'accepted'
    AND bi.category_id = categories.id
  )
);

-- pics: same pattern
CREATE POLICY "collaborators can read pics" ON pics
FOR SELECT USING (
  owner_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM budget_collaborators bc
    JOIN budget_items bi ON bi.budget_period_id = bc.budget_period_id
    WHERE bc.user_id = auth.uid()
    AND bc.status = 'accepted'
    AND bi.pic_id = pics.id
  )
);
