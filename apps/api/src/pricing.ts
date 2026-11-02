import { BadRequestException } from "@nestjs/common";

export function listPrice(
  product: Record<string, any>,
  unit: string,
  priceBook?: string,
): number {
  if (product.details?.sellable === false)
    throw new BadRequestException("Hàng hóa này đang ngừng bán.");
  const wholesale =
    unit === "PACK"
      ? product.details?.wholesalePack
      : product.details?.wholesaleBase;
  return priceBook === "WHOLESALE" && wholesale != null
    ? wholesale
    : unit === "PACK"
      ? product.price_pack
      : product.price_base;
}
