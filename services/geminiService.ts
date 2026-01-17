
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function extractWeightFromImage(base64Image: string): Promise<number> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image.split(',')[1] } },
          { text: "Look at the digital scale in this photo. Extract ONLY the numeric value shown on the screen in kilograms. If the value is '2.0', just return '2.0'. Return exactly the number, nothing else." }
        ]
      }
    });

    const text = response.text || "0";
    const weight = parseFloat(text.replace(/[^\d.]/g, ''));
    return isNaN(weight) ? 0 : weight;
  } catch (error) {
    console.error("OCR Error:", error);
    return 0;
  }
}

export async function verifyTransactionPhotos(selfieBase64: string): Promise<boolean> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: selfieBase64.split(',')[1] } },
          { text: "Analyze this verification photo. Does it clearly show at least two human faces (User and Operator)? Return 'YES' if verified, 'NO' otherwise." }
        ]
      }
    });

    return response.text?.toUpperCase().includes('YES') || false;
  } catch (error) {
    console.error("Verification Error:", error);
    return false;
  }
}

export async function verifyOperatorIdentity(ktpBase64: string, selfieBase64: string): Promise<{ match: boolean; score: number }> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: ktpBase64.split(',')[1] } },
          { inlineData: { mimeType: 'image/jpeg', data: selfieBase64.split(',')[1] } },
          { text: "Compare the person in the KTP photo with the person in the selfie. Do they appear to be the same person? Return a JSON object with 'match' (boolean) and 'score' (0-100 percentage)." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            match: { type: Type.BOOLEAN },
            score: { type: Type.NUMBER }
          },
          required: ["match", "score"]
        }
      }
    });

    const result = JSON.parse(response.text || '{"match": false, "score": 0}');
    return result;
  } catch (error) {
    console.error("Identity Verification Error:", error);
    return { match: false, score: 0 };
  }
}
