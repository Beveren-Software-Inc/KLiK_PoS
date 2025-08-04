type Invoice = {
  doctype: string;
  name: string;
  [key: string]: any; // to allow other properties
};

type PrintHTMLResponse = {
  html: string;
  style: string;
};

export async function getPrintFormatHTML(
  invoice: Invoice,
  printFormat: string
): Promise<PrintHTMLResponse> {
  const res = await fetch(
    `/api/method/frappe.www.printview.get_html_and_style?doc=${invoice.doctype}&name=${invoice.name}&print_format=${printFormat}&no_letterhead=0`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    }
  );

  const data = await res.json();
  return data.message as PrintHTMLResponse;
}
