-- Pulsanti nuovi su /link subito dopo Saldora (richiesta del 24/11): Instant Gaming, Telegram, YouTube.
-- Si può rilanciare: un pulsante già presente (stesso evento) non viene duplicato.
-- Uso: psql "$DATABASE_URL" -f scripts/sql/2026-11-24-link-instantgaming-telegram-youtube.sql
BEGIN;
DO $$
DECLARE
  anchor int;
  r record;
BEGIN
  SELECT position INTO anchor FROM bio_links WHERE title = 'Saldora' ORDER BY position LIMIT 1;
  IF anchor IS NULL THEN SELECT coalesce(max(position), -1) INTO anchor FROM bio_links; END IF;
  FOR r IN
    SELECT * FROM (VALUES
      (1, '🛒 Giochi scontati su Instant Gaming', 'https://www.instant-gaming.com/it/?igr=gamer-c5b364&utm_medium=gamer-c5b364',
          'link affiliato: se compri lì ricevo una piccola commissione, senza costi per te', 'click-instantgaming', true),
      (2, '📣 Offerte ogni sera su Telegram', 'https://t.me/saldora_offerte?utm_source=link', '', 'click-telegram', false),
      (3, '▶️ Le offerte in video su YouTube', 'https://www.youtube.com/@mdfdev08?utm_source=link', '', 'click-youtube', false)
    ) AS v(ord, title, url, note, event, sponsored)
    ORDER BY ord
  LOOP
    IF EXISTS (SELECT 1 FROM bio_links WHERE event = r.event) THEN
      SELECT position INTO anchor FROM bio_links WHERE event = r.event LIMIT 1;
      CONTINUE;
    END IF;
    UPDATE bio_links SET position = position + 1 WHERE position > anchor;
    INSERT INTO bio_links (title, subtitle, url, note, event, sponsored, new_tab, visible, position, updated_at)
      VALUES (r.title, '', r.url, r.note, r.event, r.sponsored, true, true, anchor + 1, now());
    anchor := anchor + 1;
  END LOOP;
END $$;
COMMIT;
