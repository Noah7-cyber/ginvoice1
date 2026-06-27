import React from 'react';

interface DataTableProps {
  table: {
    title: string;
    columns: string[];
    rows: (string | number)[][];
  };
}

const DataTable: React.FC<DataTableProps> = ({ table }) => {
  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm my-4">
      <div className="bg-gray-50/50 px-4 py-3 border-b border-gray-100">
        <h4 className="text-sm font-bold text-gray-900">{table.title}</h4>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-white text-gray-400 text-xs uppercase font-semibold">
            <tr>
              {table.columns.map((col, i) => (
                <th key={i} className="px-4 py-3 font-medium whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {table.rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                {row.map((cell, j) => (
                  <td key={j} className={`px-4 py-3 ${j === 0 ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;
