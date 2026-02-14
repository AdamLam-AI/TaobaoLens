import type { ProductAnalysis } from "../types";

// 1. Get the API Key
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

export const analyzeProductImage = async (base64Image: string): Promise<ProductAnalysis[]> => {
  try {
    // 2. Clean the image data
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

    // 3. Define the Prompt (Strongly enforcing JSON here)
    const myPrompt = `You are a professional Sourcing Agent for Taobao.

    **MISSION**: 
    Identify EVERY product in the image. Return a raw JSON array.

    **STRICT JSON FORMAT REQUIRED**:
    Return ONLY a valid JSON array. Do not write markdown, do not write "\`\`\`json", do not write any intro text.
    
    The JSON structure for each item must be:
    {
      "productName": "String (Simplified Chinese)",
      "category": "String (Simplified Chinese)",
      "subCategory": "String (Simplified Chinese)",
      "goldenTitle": "String (Search optimized title in Chinese)",
      "marketingTags": ["Tag1", "Tag2"],
      "detectedText": "String or null",
      "boundingBox": [ymin, xmin, ymax, xmax],
      "attributes": {
        "Category": "String",
        "Color": "String",
        "Feature": "String",
        "Material": "String",
        "Shape": "String",
        "Style": "String"
      },
      "shortDescription": "String"
    }

    **IMPORTANT**: 
    - All text values must be in Simplified Chinese.
    - Bounding box coordinates must be normalized (0-1000).
    - If multiple items, return multiple objects in the array.`;

    // 4. Send Request via PROXY (Using Stable v1)
    // We use the standard 'gemini-1.5-flash' on the 'v1' channel.
    // This previously gave a 400 error because of "response_schema".
    // We have REMOVED "response_schema" below, so it should now work.
    const url = `/google-api/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
    
    console.log("Using Robust v1 URL:", url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: myPrompt },
            {
              inline_data: {
                mime_type: "image/jpeg",
                data: cleanBase64
              }
            }
          ]
        }]
        // REMOVED: generationConfig (This was the cause of the 400 error!)
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Google API Error:", errorText);
      throw new Error(`API Request Failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("Gemini returned no candidates.");
    }

    let textResult = data.candidates[0].content.parts[0].text;

    // 5. Clean the response (Remove markdown if the AI adds it)
    textResult = textResult.replace(/```json/g, "").replace(/```/g, "").trim();

    return JSON.parse(textResult) as ProductAnalysis[];

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};
