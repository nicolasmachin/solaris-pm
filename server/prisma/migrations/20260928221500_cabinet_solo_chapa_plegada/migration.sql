-- El gabinete se fabrica entero en chapa plegada y se entrega SIN HERRAJES:
-- la tapa va suelta y Voltia decide después si le pone bisagra o tranca. Por
-- eso salen del pedido el cierre, las bisagras, la ventilación y el grado IP,
-- que no son chapa ni los provee este fabricante.
ALTER TABLE "cabinet_designs" DROP COLUMN "tipoCierre";
ALTER TABLE "cabinet_designs" DROP COLUMN "bisagras";
ALTER TABLE "cabinet_designs" DROP COLUMN "bisagrasCantidad";
ALTER TABLE "cabinet_designs" DROP COLUMN "bisagrasLado";
ALTER TABLE "cabinet_designs" DROP COLUMN "bisagraDistExtremoCm";
ALTER TABLE "cabinet_designs" DROP COLUMN "ventilacion";
ALTER TABLE "cabinet_designs" DROP COLUMN "gradoIp";

-- La tapa no tiene alero: es plana y a ras del cuerpo. Lo que sobresale es su
-- reborde plegado, que ya se mide con rebordeTapaCm.
ALTER TABLE "cabinet_designs" DROP COLUMN "alaTapaCm";

-- El radio de plegado no aplica para este fabricante.
ALTER TABLE "cabinet_designs" DROP COLUMN "radioDoblezMm";

-- Renombres (no drop + add) para no perder las medidas ya cargadas: lo que
-- llamábamos puerta/marco es tapa/frente del cuerpo.
ALTER TABLE "cabinet_designs" RENAME COLUMN "perfilPuertaCm" TO "rebordeTapaCm";
ALTER TABLE "cabinet_designs" RENAME COLUMN "perfilMarcoCm" TO "rebordeFrenteCm";
ALTER TABLE "cabinet_designs" RENAME COLUMN "solapePuertaCm" TO "solapeTapaCm";
ALTER TABLE "cabinet_designs" RENAME COLUMN "holguraPuertaMm" TO "holguraTapaMm";
