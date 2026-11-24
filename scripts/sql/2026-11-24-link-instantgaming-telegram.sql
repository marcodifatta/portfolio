-- Due pulsanti nuovi su /link subito dopo Saldora (richiesta del 24/11). Si applica una volta sola.
BEGIN;
DO $$
DECLARE p int;
BEGIN
  IF EXISTS (SELECT 1 FROM bio_links WHERE event IN ('click-instantgaming','click-telegram')) THEN
    RAISE NOTICE 'già presenti, niente da fare'; RETURN;
  END IF;
  SELECT position INTO p FROM bio_links WHERE title = 'Saldora' ORDER BY position LIMIT 1;
  IF p IS NULL THEN SELECT coalesce(max(position), -1) INTO p FROM bio_links; END IF;
  UPDATE bio_links SET position = position + 2 WHERE position > p;
  INSERT INTO bio_links (title, subtitle, url, note, event, sponsored, new_tab, visible, position, updated_at) VALUES
    ('🛒 Giochi scontati su Instant Gaming', '', 'https://www.instant-gaming.com/it/?igr=gamer-c5b364&utm_medium=gamer-c5b364',
     'link affiliato: se compri lì ricevo una piccola commissione, senza costi per te', 'click-instantgaming', true, true, true, p + 1, now()),
    ('📣 Offerte ogni sera su Telegram', '', 'https://t.me/saldora_offerte?utm_source=link',
     '', 'click-telegram', false, true, true, p + 2, now());
END $$;
COMMIT;
