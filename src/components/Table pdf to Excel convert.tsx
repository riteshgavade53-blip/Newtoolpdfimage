import React, { useEffect } from "react";

const TablePdfToExcel = () => {
  useEffect(() => {
    window.location.href = "/Pdf To Excel/index.html";
  }, []);

  return (
    <div style={{ padding: "20px", fontSize: "18px" }}>
      Redirecting...
    </div>
  );
};

export default TablePdfToExcel;
