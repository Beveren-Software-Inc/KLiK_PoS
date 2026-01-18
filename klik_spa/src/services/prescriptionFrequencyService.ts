export interface PrescriptionFrequency {
  name: string;
  frequency?: string;
  prescription_frequency?: string;
  [key: string]: unknown;
}

export async function getPrescriptionFrequencies(): Promise<PrescriptionFrequency[]> {
  try {
    const response = await fetch(`/api/method/klik_pos.api.prescription_frequency.get_prescription_frequencies`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch Prescription Frequencies');
    }

    if (data?.message) {
      return data.message;
    }

    return [];
  } catch (error) {
    console.error(`Error fetching Prescription Frequencies:`, error);
    return [];
  }
}

