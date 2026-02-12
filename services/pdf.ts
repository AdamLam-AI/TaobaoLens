import * as pdfjs from 'pdfjs-dist';

// Configure the worker
pdfjs.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.mjs';

export async function extractImagesFromPdf(pdfBuffer: ArrayBuffer): Promise<{ base64: string; previewUrl: string }[]> {
  const loadingTask = pdfjs.getDocument({ data: pdfBuffer });
  const pdf = await loadingTask.promise;
  const extractedImages: { base64: string; previewUrl: string }[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const operatorList = await page.getOperatorList();
    
    // We want to find images embedded in the page
    // pdfjs.ops.paintImageXObject is for embedded images
    // For simplicity and "separating product photos", we'll also allow page-to-image as a fallback
    // if no specific images are found or if requested.
    // However, usually "separating product photos" means finding the actual images.
    
    const commonObjs = page.commonObjs;
    const objs = page.objs;

    for (let j = 0; j < operatorList.fnArray.length; j++) {
      const fn = operatorList.fnArray[j];
      if (fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintInlineImageXObject) {
        const imgKey = operatorList.argsArray[j][0];
        let img;
        
        try {
          img = objs.get(imgKey) || commonObjs.get(imgKey);
        } catch (e) {
          continue;
        }

        if (img && img.data) {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          // PDF images often use different pixel formats, so we draw it
          const imageData = ctx.createImageData(img.width, img.height);
          
          // Handle RGB or RGBA
          if (img.data.length === img.width * img.height * 3) {
             for (let p = 0, q = 0; p < img.data.length; p += 3, q += 4) {
                imageData.data[q] = img.data[p];
                imageData.data[q+1] = img.data[p+1];
                imageData.data[q+2] = img.data[p+2];
                imageData.data[q+3] = 255;
             }
          } else {
             imageData.data.set(img.data);
          }
          
          ctx.putImageData(imageData, 0, 0);
          
          const previewUrl = canvas.toDataURL('image/jpeg', 0.8);
          const base64 = previewUrl.split(',')[1];
          extractedImages.push({ base64, previewUrl });
        }
      }
    }

    // Fallback: If no images found on page, treat whole page as one product image
    if (extractedImages.length === 0) {
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (context) {
            await page.render({ canvasContext: context, viewport }).promise;
            const previewUrl = canvas.toDataURL('image/jpeg', 0.8);
            const base64 = previewUrl.split(',')[1];
            extractedImages.push({ base64, previewUrl });
        }
    }
  }

  return extractedImages;
}