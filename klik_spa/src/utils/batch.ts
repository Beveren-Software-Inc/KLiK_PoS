// utils/batch.ts
export async function getBatches(itemCode: string) {
  const response = await fetch(
    `/api/method/klik_pos.api.item.get_batch_nos_with_qty?item_code=${encodeURIComponent(itemCode)}`
  );
  const resData = await response.json();
  if (resData?.message && Array.isArray(resData.message)) {

    return resData.message;
  }

  throw new Error("Invalid response format");
}
