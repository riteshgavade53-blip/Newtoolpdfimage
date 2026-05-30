import { useEffect } from "react";

export default function TablePdfToExcel() {
  useEffect(() => {
    window.location.replace("/Pdf To Excel/index.html");
    // Ya agar encoded chahiye:
    // window.location.replace("/Pdf%20To%20Excel/index.html");
  }, []);

  return <div>Loading...</div>;
}
