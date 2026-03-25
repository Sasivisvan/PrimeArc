import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config();

const geminiModel = new ChatGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY,
    model: "gemini-2.5-flash",
});

async function main() {
    // create a dummy PDF base64
    const pdfBase64 = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 53 >>\nstream\nBT\n/F1 24 Tf\n100 100 Td\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000214 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n316\n%%EOF\n").toString("base64");

    try {
        const msgContent = [
            { type: "text", text: "What does this document say?" },
            { type: "media", mimeType: "application/pdf", data: pdfBase64 }
        ];
        
        const response = await geminiModel.invoke([ ["human", msgContent] ]);
        console.log("Success:", response.content);
    } catch (e) {
        console.error("Error with 'media':", e.message);
        try {
            const msgContent2 = [
                { type: "text", text: "What does this document say?" },
                {
                    type: "document_url",
                    document_url: `data:application/pdf;base64,${pdfBase64}`
                }
            ];
            const response2 = await geminiModel.invoke([ ["human", msgContent2] ]);
            console.log("Success with document_url:", response2.content);
        } catch(e2) {
            console.error("Error with 'document_url':", e2.message);
            // try image_url with data URI
            try {
                const msgContent3 = [
                    { type: "text", text: "What does this document say?" },
                    { type: "image_url", image_url: `data:application/pdf;base64,${pdfBase64}` }
                ];
                const response3 = await geminiModel.invoke([ ["human", msgContent3] ]);
                console.log("Success with image_url:", response3.content);
            } catch (e3) {
                console.error("Error with image_url:", e3.message);
            }
        }
    }
}
main();
