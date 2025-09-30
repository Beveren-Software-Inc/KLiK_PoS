export async function getSerials(itemCode: string): Promise<string[]> {
  try {
    const res = await fetch(`/api/method/klik_pos.api.item.get_serial_nos_for_item?item_code=${encodeURIComponent(itemCode)}`)
    if (!res.ok) return []
    const data = await res.json()
    if (Array.isArray(data?.message)) {
      return data.message.map((s: any) => s.serial_no).filter(Boolean)
    }
    return []
  } catch {
    return []
  }
}


