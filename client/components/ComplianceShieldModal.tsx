import React from 'react';
import { Shield, Lock } from 'lucide-react';

interface ComplianceShieldModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

const ComplianceShieldModal: React.FC<ComplianceShieldModalProps> = ({ onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-indigo-600 p-6 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield size={32} className="text-white" />
          </div>
          <h2 className="text-xl font-bold">Activate Compliance Shield?</h2>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-gray-600 text-sm leading-relaxed">
            G-invoice can estimate your tax liability to help you plan. This happens
            <strong> privately on your device</strong>. We do not report this data to the FIRS.
          </p>

          <div className="flex items-start gap-3 bg-indigo-50 p-3 rounded-lg">
             <Lock size={16} className="text-indigo-600 mt-1 shrink-0" />
             <p className="text-xs text-indigo-800">
               <strong>Privacy First:</strong> This is an estimation tool for your internal use only.
             </p>
          </div>
        </div>

        <div className="p-6 pt-0 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-colors"
          >
            No, Thanks
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors"
          >
            Enable Shield
          </button>
        </div>
      </div>
    </div>
  );
};

export default ComplianceShieldModal;
