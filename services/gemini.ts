import { GoogleGenAI, Type } from "@google/genai";
import { ProductAnalysis } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeProductImage = async (base64Image: string): Promise<ProductAnalysis[]> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          },
          {
            text: `You are a professional Sourcing & Image Separation Agent specialized in the Chinese market (Taobao).
            
            **MISSION**: 
            Scan the image and identify EVERY distinct product. If multiple items are shown, separate them into individual entries.

            **FOR EACH PRODUCT DETECTED (USE SIMPLIFIED CHINESE)**:
            1.  **Category (类别)**: General category (e.g., 服装).
            2.  **Sub-Category (子类别)**: Specific sub-category (e.g., T恤, 连衣裙).
            3.  **Color (颜色)**: Specific color.
            4.  **Feature (特色)**: Distinguishing detail (e.g., 蕾丝, 荷叶边).
            5.  **Material (材质)**: Estimated fabric (e.g., 纯棉).
            6.  **Shape (版型)**: Fit style (e.g., 修身).
            7.  **Style (风格)**: General vibe (e.g., 简约).
            8.  **Golden Title (搜索标题)**: A Simplified Chinese search string optimized for Taobao. 
                **PRIORITY ORDER**: [类别] + [颜色] + [特色] + [材质].
            9.  **Bounding Box**: Normalized coordinates [ymin, xmin, ymax, xmax] (0-1000).

            **IMPORTANT**: All text values must be in Simplified Chinese (简体中文).`
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              productName: { type: Type.STRING },
              category: { type: Type.STRING },
              subCategory: { type: Type.STRING },
              goldenTitle: { type: Type.STRING },
              marketingTags: { type: Type.ARRAY, items: { type: Type.STRING } },
              detectedText: { type: Type.STRING, nullable: true },
              boundingBox: { 
                type: Type.ARRAY, 
                items: { type: Type.NUMBER }, 
                description: "[ymin, xmin, ymax, xmax] normalized coordinates 0-1000"
              },
              attributes: { 
                type: Type.OBJECT, 
                properties: {
                  "Category": { type: Type.STRING },
                  "Color": { type: Type.STRING },
                  "Feature": { type: Type.STRING },
                  "Material": { type: Type.STRING },
                  "Shape": { type: Type.STRING },
                  "Style": { type: Type.STRING }
                }
              },
              shortDescription: { type: Type.STRING }
            },
            required: ["productName", "goldenTitle", "attributes", "category", "subCategory", "shortDescription", "boundingBox"],
          }
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as ProductAnalysis[];
  } catch (error) {
    console.error("Gemini Multi-Analysis Error:", error);
    throw error;
  }
};