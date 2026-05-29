import { useEffect } from "react";

export default function TablePdfToExcel() {
  useEffect(() => {
    window.location.replace("/pdf-to-excel/index.html");
  }, []);

  return <div>Loading...</div>;
}
