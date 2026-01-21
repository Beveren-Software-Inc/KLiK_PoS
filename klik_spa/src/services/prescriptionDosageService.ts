export interface PrescriptionDosage {
  name: string;
  dosage?: string;
  [key: string]: unknown;
}

export async function getPrescriptionDosages(): Promise<PrescriptionDosage[]> {
  try {
    console.log('📡 Fetching prescription dosages from API...');
    const response = await fetch(`/api/method/klik_pos.api.prescription_dosage.get_prescription_dosages`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    console.log('📡 API Response status:', response.status, response.statusText);

    const data = await response.json();
    console.log('📡 API Response data:', data);

    if (!response.ok) {
      console.error('❌ API Error:', data.message || 'Failed to fetch Prescription Dosages');
      throw new Error(data.message || 'Failed to fetch Prescription Dosages');
    }

    if (data?.message) {
      console.log('✅ Prescription dosages received:', data.message);
      return data.message;
    }

    console.warn('⚠️ No message in response, returning empty array');
    return [];
  } catch (error) {
    console.error(`❌ Error fetching Prescription Dosages:`, error);
    return [];
  }
}
