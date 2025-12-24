// client/services/pdf.ts
// Helper that accepts a Blob (PDF) or string content and shares it reliably across platforms.
// It uses navigator.share when available (mobile) and falls back to a download anchor for desktop.
// This mirrors a robust cross-platform approach for PDFs.

export async function sharePdfBlob(blob: Blob, filename = 'invoice.pdf') {
  try {
    // Use the Web Share API if available and supports files
    const canShareFiles = !!(navigator as any).canShare && (navigator as any).canShare({ files: [new File([blob], filename, { type: blob.type })] });

    if ((navigator as any).share && canShareFiles) {
      const file = new File([blob], filename, { type: blob.type });
      await (navigator as any).share({
        files: [file],
        title: 'Invoice',
        text: 'Here is your invoice'
      });
      return;
    }

    // Fallback: create a binary URL and open in new tab — on mobile this often triggers "Open with" or allows the user to share via system UI.
    const url = URL.createObjectURL(blob);
    // Open this URL in a new tab (desktop) or use a download anchor for forced download.
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    // Append and click to trigger download
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 5000);
  } catch (err) {
    console.error('sharePdfBlob failed', err);
    // last fallback: open blob URL
    const urlFallback = URL.createObjectURL(blob);
    window.open(urlFallback, '_blank');
    setTimeout(() => URL.revokeObjectURL(urlFallback), 10_000);
  }
}