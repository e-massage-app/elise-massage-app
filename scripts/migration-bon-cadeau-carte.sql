-- v1.2.1.0 : textes imprimes sur le bon cadeau (PDF cree depuis l'app).
-- { offertPar, pour, soin, message } tels qu'Elise les a valides : reimprimer donne le meme bon.
-- Idempotente : peut etre rejouee sans effet.
ALTER TABLE public.bons_cadeaux ADD COLUMN IF NOT EXISTS carte JSONB;

COMMENT ON COLUMN public.bons_cadeaux.carte IS
  'Textes imprimes sur le bon cadeau (offertPar, pour, soin, message), v1.2.1.0';
