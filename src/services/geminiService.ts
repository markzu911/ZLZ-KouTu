async function callGeminiProxy(model: string, payload: any) {
    const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model, payload }),
    });
    
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to communicate with Gemini API");
    }
    
    return res.json();
}

export async function analyzeImageWithGemini(base64Image: string) {
    const [header, base64] = base64Image.split(",");
    const mimeType = header.match(/data:(.*);base64/)?.[1] || "image/png";

    const payload = {
        contents: {
            parts: [
                { text: "Identify all distinct objects in this image. For each object, provide its name and its bounding box in [ymin, xmin, ymax, xmax] format (normalized 0-1000). Return ONLY a JSON array, e.g., [{\"id\": 1, \"name\": \"mouse\", \"box_2d\": [100, 100, 200, 200]}]" },
                {
                    inlineData: {
                        data: base64,
                        mimeType: mimeType,
                    },
                }
            ]
        }
    };
    
    const response = await callGeminiProxy("gemini-3.1-flash-lite", payload);

    // candidates[0].content.parts[0].text is the standard structure
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    const jsonMatch = text?.match(/\[.*\]/s);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
}

export async function processImageTask(base64Image: string, task: 'cutout' | 'remove', objectNames: string[], boxes: number[][], quality: string, ratio: string) {
    const [header, base64] = base64Image.split(",");
    const mimeType = header.match(/data:(.*);base64/)?.[1] || "image/png";

    const prompt = task === 'cutout' 
        ? `Perform a pixel-perfect extraction of the ${objectNames[0]} from this image. The cutout MUST remain exactly identical to its appearance in the original photo, with zero alterations to its colors, textures, or details. Place it on a pure, solid white background (#FFFFFF). Resolution: ${quality}, Aspect Ratio: ${ratio}.`
        : `Remove these objects: ${objectNames.join(', ')} from this image. Their bounding boxes are ${JSON.stringify(boxes)}. Automatically heal and reconstruct the background and surrounding textures perfectly as if these objects never existed. Resolution: ${quality}, Aspect Ratio: ${ratio}.`;

    const payload = {
        contents: {
            parts: [
                { text: prompt },
                { inlineData: { data: base64, mimeType } }
            ]
        },
        config: {
            imageConfig: {
                aspectRatio: ratio as any,
                imageSize: quality.toUpperCase() as any
            }
        }
    };

    const response = await callGeminiProxy("gemini-3.1-flash-image-preview", payload);

    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
    }

    return response.candidates?.[0]?.content?.parts?.[0]?.text;
}
