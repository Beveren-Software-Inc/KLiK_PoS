export interface Patient {
  name: string;
  patient_name?: string;
  patient_id?: string;
  file_no?: string;
}

export interface InpatientMedicationOrderItem {
  drug: string;
  drug_name?: string;
  dosage?: string;
  dosage_form?: string;
  period?: string;
  quantity?: number;
}

export interface InpatientMedicationOrder {
  name: string;
  patient: string;
  patient_name?: string;
  status?: string;
  posting_date?: string;
  items: InpatientMedicationOrderItem[];
}

export async function searchPatients(searchQuery: string): Promise<Patient[]> {
  try {
    const response = await fetch(`/api/method/klik_pos.api.patient.search_patients?search_query=${encodeURIComponent(searchQuery)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to search patients');
    }

    if (data?.message) {
      return data.message;
    }

    return [];
  } catch (error) {
    console.error(`Error searching patients:`, error);
    return [];
  }
}

export async function getPendingInpatientMedicationOrders(patient: string): Promise<InpatientMedicationOrder[]> {
  try {
    const apiUrl = `/api/method/klik_pos.api.patient.get_pending_inpatient_medication_orders?patient=${encodeURIComponent(patient)}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch medication orders');
    }

    if (data?.message) {
      return data.message;
    }

    return [];
  } catch (error) {
    console.error(`Error fetching medication orders:`, error);
    return [];
  }
}
