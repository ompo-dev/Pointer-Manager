ALTER TABLE "AuthorizedNetwork"
  RENAME COLUMN "ipv4Cidr" TO "localIpv4Cidr";

ALTER TABLE "AuthorizedNetwork"
  ADD COLUMN "publicIpv4Cidr" TEXT;
