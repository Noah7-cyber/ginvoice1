import React, { useState, useCallback } from 'react';
import Papa from 'papaparse';
import { useDropzone } from 'react-dropzone';
import api from '../services/api';
import { useTranslation } from 'react-i18next';
import { Download, UploadCloud, X, AlertCircle, CheckCircle } from 'lucide-react';

interface BulkImportModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface ParsedProduct {
  name: string;
  category: string;
  quantity: string;
  sellingPrice: string;
  costPrice: string;
  [key: string]: string;
}

interface ValidationError {
  rowIndex: number;
  field: keyof ParsedProduct;
  message: string;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({ onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [parsedData, setParsedData] = useState<ParsedProduct[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const expectedHeaders = ['Item Name', 'Category', 'Quantity', 'Selling Price', 'Cost Price'];

  const downloadTemplate = () => {
    const csvContent = "Item Name,Category,Quantity,Selling Price,Cost Price\nCoca-Cola,Beverage,50,150,100\nMilk,Dairy,20,500,400\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "ginvoice_inventory_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setStep(2);
  };

  const validateData = (data: any[]) => {
    const newErrors: ValidationError[] = [];
    const formattedData: ParsedProduct[] = [];

    data.forEach((row, index) => {
      const product = {
        name: row['Item Name']?.trim() || '',
        category: row['Category']?.trim() || '',
        quantity: row['Quantity']?.trim() || '',
        sellingPrice: row['Selling Price']?.trim() || '',
        costPrice: row['Cost Price']?.trim() || '',
      };

      if (!product.name) newErrors.push({ rowIndex: index, field: 'name', message: 'Item Name is required' });
      if (!product.category) newErrors.push({ rowIndex: index, field: 'category', message: 'Category is required' });

      if (!product.quantity) newErrors.push({ rowIndex: index, field: 'quantity', message: 'Quantity is required' });
      else if (isNaN(Number(product.quantity))) newErrors.push({ rowIndex: index, field: 'quantity', message: 'Must be a number' });

      if (!product.sellingPrice) newErrors.push({ rowIndex: index, field: 'sellingPrice', message: 'Selling Price is required' });
      else if (isNaN(Number(product.sellingPrice))) newErrors.push({ rowIndex: index, field: 'sellingPrice', message: 'Must be a number' });

      if (!product.costPrice) newErrors.push({ rowIndex: index, field: 'costPrice', message: 'Cost Price is required' });
      else if (isNaN(Number(product.costPrice))) newErrors.push({ rowIndex: index, field: 'costPrice', message: 'Must be a number' });

      formattedData.push(product);
    });

    setErrors(newErrors);
    setParsedData(formattedData);
    setStep(3);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data.length > 1000) {
            setUploadError('File contains more than 1,000 products. Please reduce the size to a maximum of 1,000 rows.');
            setStep(3); // Go to step 3 to show the error
            return;
          }
          validateData(results.data);
        },
      });
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
  });

  const handleCellEdit = (rowIndex: number, field: keyof ParsedProduct, value: string) => {
    const newData = [...parsedData];
    newData[rowIndex][field] = value;

    // Re-validate just this cell to remove error if fixed, or add if broken
    let newErrors = errors.filter(e => !(e.rowIndex === rowIndex && e.field === field));

    if (!value) {
       newErrors.push({ rowIndex, field, message: 'Required' });
    } else if ((field === 'quantity' || field === 'sellingPrice' || field === 'costPrice') && isNaN(Number(value))) {
       newErrors.push({ rowIndex, field, message: 'Must be a number' });
    }

    setErrors(newErrors);
    setParsedData(newData);
  };

  const getCellError = (rowIndex: number, field: keyof ParsedProduct) => {
    return errors.find(e => e.rowIndex === rowIndex && e.field === field);
  };

  const handleConfirmImport = async () => {
    if (errors.length > 0) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      await api.post('/api/bulk-import', { products: parsedData });
      onSuccess();
      onClose();
    } catch (err: any) {
      setUploadError(err.response?.data?.error || err.message || 'Failed to import products');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Bulk CSV Import</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-50">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {step === 1 && (
            <div className="text-center space-y-6 max-w-lg mx-auto py-8">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto">
                <Download size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Step 1: Download the Template</h3>
                <p className="text-gray-600">Start by downloading our formatted CSV template. It includes dummy data to show you exactly how to format your products.</p>
              </div>
              <button
                onClick={downloadTemplate}
                className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Download Template
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8">
              <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-4">
                 <AlertCircle className="text-blue-600 flex-shrink-0 mt-1" />
                 <div>
                   <h4 className="font-semibold text-blue-900">Step 2: Fill it out</h4>
                   <p className="text-blue-800 text-sm mt-1">Make sure you have these exact columns. Do not include letters in the quantity or price columns.</p>
                   <div className="flex flex-wrap gap-2 mt-3">
                     {expectedHeaders.map(h => (
                       <span key={h} className="px-2 py-1 bg-white text-blue-700 rounded shadow-sm text-xs font-mono">{h}</span>
                     ))}
                   </div>
                 </div>
              </div>

              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                }`}
              >
                <input {...getInputProps()} />
                <UploadCloud size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-900">Step 3: Upload your filled CSV</p>
                <p className="text-gray-500 mt-2">Drag and drop your file here, or click to select</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Validation Preview</h3>
                  <p className="text-sm text-gray-600">
                    {errors.length === 0
                      ? "Looking good! No errors found."
                      : `Found ${errors.length} error(s). Please fix them highlighted in red below to continue.`}
                  </p>
                </div>
                <button
                  onClick={() => setStep(2)}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Upload a different file
                </button>
              </div>

              {uploadError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
                  <AlertCircle size={16} />
                  {uploadError}
                </div>
              )}

              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-3 font-medium text-gray-500">Item Name</th>
                      <th className="p-3 font-medium text-gray-500">Category</th>
                      <th className="p-3 font-medium text-gray-500">Quantity</th>
                      <th className="p-3 font-medium text-gray-500">Selling Price</th>
                      <th className="p-3 font-medium text-gray-500">Cost Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedData.map((row, index) => (
                      <tr key={index}>
                        {(['name', 'category', 'quantity', 'sellingPrice', 'costPrice'] as const).map((field) => {
                          const error = getCellError(index, field);
                          return (
                            <td key={field} className={`p-2 relative group`}>
                              <input
                                type="text"
                                value={row[field]}
                                onChange={(e) => handleCellEdit(index, field, e.target.value)}
                                className={`w-full p-2 border rounded focus:outline-none focus:ring-1 ${
                                  error
                                    ? 'border-red-500 bg-red-50 focus:ring-red-500'
                                    : 'border-transparent hover:border-gray-200 focus:border-blue-500 focus:bg-white bg-transparent'
                                }`}
                              />
                              {error && (
                                <div className="absolute left-1/2 -top-8 -translate-x-1/2 bg-red-900 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 pointer-events-none z-10 whitespace-nowrap">
                                  {error.message}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          {step === 3 && (
            <button
              onClick={handleConfirmImport}
              disabled={errors.length > 0 || isUploading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isUploading ? 'Importing...' : 'Confirm Import'}
              {!isUploading && errors.length === 0 && <CheckCircle size={18} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
