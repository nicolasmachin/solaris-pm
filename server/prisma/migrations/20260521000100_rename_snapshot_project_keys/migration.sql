-- Snapshots de EFP (EFPVersion.snapshotProject) usaban las keys JSON
-- "notificationEmail" / "notificationPhone". El campo ya se renombró a
-- "clientEmail"/"clientPhone" en projects, pero los snapshots viejos
-- guardaron el nombre histórico. Esta migración rebautiza las keys del JSON
-- para que el PDF v2 (que lee `snapshot.clientEmail`) siga mostrando el
-- email/teléfono del cliente capturado en el momento.

UPDATE "efp_versions"
SET "snapshotProject" =
  (
    ("snapshotProject" - 'notificationEmail' - 'notificationPhone')
    || (CASE WHEN "snapshotProject" ? 'notificationEmail'
             THEN jsonb_build_object('clientEmail', "snapshotProject"->'notificationEmail')
             ELSE '{}'::jsonb END)
    || (CASE WHEN "snapshotProject" ? 'notificationPhone'
             THEN jsonb_build_object('clientPhone', "snapshotProject"->'notificationPhone')
             ELSE '{}'::jsonb END)
  )
WHERE "snapshotProject" IS NOT NULL
  AND ("snapshotProject" ? 'notificationEmail' OR "snapshotProject" ? 'notificationPhone');
