import type { ProductAnalysis } from "../types";

// 1. Get the API Key
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

export const analyzeProductImage = async (base64Image: string): Promise<ProductAnalysis[]> => {
  try {
    // 2. Clean the image data
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

    // 3. Define the Schema
    const responseSchema = {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          productName: { type: "STRING" },
          category: { type: "STRING" },
          subCategory: { type: "STRING" },
          goldenTitle: { type: "STRING" },
          marketingTags: { type: "ARRAY", items: { type: "STRING" } },
          detectedText: { type: "STRING", nullable: true },
          boundingBox: {
            type: "ARRAY",
            items: { type: "NUMBER" },
            description: "[ymin, xmin, ymax, xmax] normalized coordinates"
          },
          attributes: {
            type: "OBJECT",
            properties: {
              "Category": { type: "STRING" },
              "Color": { type: "STRING" },
              "Feature": { type: "STRING" },
              "Material": { type: "STRING" },
              "Shape": { type: "STRING" },
              "Style": { type: "STRING" }
            }
          },
          shortDescription: { type: "STRING" }
        },
        required: ["productName", "goldenTitle", "attributes", "category", "subCategory", "shortDescription", "boundingBox"]
      }
    };

    // 4. Define the Prompt
    const myPrompt = `You are a professional Sourcing & Image Separation Agent specialized in the Chinese market (Taobao).

    **MISSION**: 
    Scan the image and identify EVERY distinct product. If multiple items are shown, separate them into individual entries.

    **FOR EACH PRODUCT DETECTED (USE SIMPLIFIED CHINESE)**:
    1. **Category (类目)**: General category (e.g., 服装).
    2. **Sub Category (子类目)**: Specific sub category (e.g., T恤, 连衣裙).
    3. **Color (颜色)**: Specific color.
    4. **Feature (特点)**: Distinguishing detail (e.g., 圆领, 纽扣).
    5. **Material (材质)**: Estimated fabric (e.g., 棉质).
    6. **Shape (版型)**: Fit style (e.g., 修身).
    7. **Style (风格)**: General vibe (e.g., 休闲).
    8. **Golden Title (淘宝标题)**: A Simplified Chinese search string optimized for Taobao.
       **PRIORITY ORDER**: [风格] + [版型] + [材质] + [特点] + [类目].
    9. **Bounding Box**: Normalized coordinates [ymin, xmin, ymax, xmax] (0-1000).

    **IMPORTANT**: All text values must be in Simplified Chinese (简体中文).`;

    // 5. Send Request via PROXY (Using the -001 Stable Version)
    const response = await fetch(`/google-api/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`, {
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
        }],
        generationConfig: {
          response_mime_type: "application/json",
          response_schema: responseSchema
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Request Failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error("Gemini returned no candidates.");
    }

    const textResult = data.candidates[0].content.parts[0].text;
    return JSON.parse(textResult) as ProductAnalysis[];

  } catch (error) {
    console.error("Gemini Multi Analysis Error:", error);
    throw error;
  }
};
