import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize GoogleGenAI client on the server
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// JSON body parser with increased limit to support multiple image base64 uploads (up to 7 images)
app.use(express.json({ limit: "50mb" }));

// API Endpoint for analyzing text (manual questions copy-paste)
app.post("/api/analyze-text", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "عذراً، يجب إدخال نص الأسئلة أولاً." });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `قم بتحليل هذا النص واستخراج الأسئلة منه بشكل منظم لإنشاء Google Form.
النص يحتوي على مجموعة أسئلة:
---
${text}
---

قم بصياغة الأسئلة واقتراح خيارات إذا لزم الأمر، ثم أرجع النتيجة بصيغة JSON مطابقة تماماً للمواصفات التالية:
{
  "title": "عنوان النموذج المناسب بناء على المحتوى",
  "description": "وصف قصير للنموذج",
  "questions": [
    {
      "text": "نص السؤال بالكامل بأسلوب واضح ومفهوم للطلاب أو المشاركين",
      "type": "short_answer" | "paragraph" | "multiple_choice" | "checkbox" | "dropdown",
      "options": ["خيار 1", "خيار 2", "خيار 3"], // تضاف فقط إذا كان النوع اختيارات أو مربعات اختيار أو قائمة منسدلة، وإلا مصفوفة فارغة
      "required": true // افتراضياً اجعلها true لتكون الأسئلة إجبارية
    }
  ]
}

تأكد من إرجاع JSON صالح فقط، بدون أي علامات markdown أو تفسيرات خارج الـ JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["title", "questions"],
          properties: {
            title: { type: Type.STRING, description: "The title of the form" },
            description: { type: Type.STRING, description: "A brief description or instructions for the form" },
            questions: {
              type: Type.ARRAY,
              description: "The list of questions extracted",
              items: {
                type: Type.OBJECT,
                required: ["text", "type", "required"],
                properties: {
                  text: { type: Type.STRING, description: "The question text" },
                  type: {
                    type: Type.STRING,
                    description: "The type of question",
                    enum: ["short_answer", "paragraph", "multiple_choice", "checkbox", "dropdown"]
                  },
                  options: {
                    type: Type.ARRAY,
                    description: "Options if choice-based, empty otherwise",
                    items: { type: Type.STRING }
                  },
                  required: { type: Type.BOOLEAN, description: "Whether the question is required" }
                }
              }
            }
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("لم يتم تلقي استجابة صالحة من Gemini");
    }

    const parsed = JSON.parse(resultText.trim());
    res.json(parsed);
  } catch (error: any) {
    console.error("Error analyzing text:", error);
    res.status(500).json({ error: error.message || "حدث خطأ أثناء تحليل الأسئلة." });
  }
});

// API Endpoint for analyzing image of exam / paper
app.post("/api/analyze-image", async (req, res) => {
  req.setTimeout(0); // Disable client/request timeout to prevent disconnects on long operations
  res.setTimeout(0); // Disable response timeout
  
  try {
    const { imageBase64, mimeType, images } = req.body;
    
    // Support both single image (legacy/fallback) and multiple images
    let imageParts: any[] = [];
    
    if (images && Array.isArray(images)) {
      if (images.length === 0) {
        return res.status(400).json({ error: "عذراً، يجب تحميل صورة واحدة على الأقل." });
      }
      if (images.length > 7) {
        return res.status(400).json({ error: "عذراً، الحد الأقصى هو 7 صور في المرة الواحدة." });
      }
      imageParts = images.map((img: any) => ({
        inlineData: {
          mimeType: img.mimeType,
          data: img.imageBase64,
        }
      }));
    } else {
      if (!imageBase64 || !mimeType) {
        return res.status(400).json({ error: "عذراً، يجب تحميل صورة الأسئلة أولاً." });
      }
      imageParts = [{
        inlineData: {
          mimeType: mimeType,
          data: imageBase64,
        }
      }];
    }

    console.log(`[Server] Starting parallel image analysis with Gemini for ${imageParts.length} images...`);
    const startTime = Date.now();

    // Map each image part to a separate Gemini API call running in parallel to speed up extraction and prevent timeouts
    const analysisPromises = imageParts.map(async (imagePart, index) => {
      const promptText = `قم بتحليل هذه الصورة (الصفحة رقم ${index + 1} من أصل ${imageParts.length} من أوراق الامتحان) واستخراج كافة الأسئلة والخيارات المكتوبة بخط اليد أو المطبوعة بدقة بالغة وبأقصى سرعة ممكنة.
قم بصياغة وتصنيف الأسئلة بشكل ممتاز ومناسب لإنشاء Google Form باللغة العربية.
أرجع النتيجة بصيغة JSON مطابقة تماماً للمواصفات التالية:
{
  "title": "عنوان النموذج المناسب للمحتوى",
  "description": "وصف قصير للنموذج",
  "questions": [
    {
      "text": "نص السؤال بالكامل بأسلوب واضح ومفهوم للطلاب أو المشاركين",
      "type": "short_answer" | "paragraph" | "multiple_choice" | "checkbox" | "dropdown",
      "options": ["خيار 1", "خيار 2", "خيار 3"], // تضاف فقط إذا كان النوع اختيارات أو مربعات اختيار أو قائمة منسدلة، وإلا مصفوفة فارغة
      "required": true // افتراضياً اجعلها true لتكون الأسئلة إجبارية
    }
  ]
}

تأكد من إرجاع JSON صالح فقط، بدون أي علامات markdown أو تفسيرات خارج الـ JSON.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: [imagePart, { text: promptText }] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            required: ["title", "questions"],
            properties: {
              title: { type: Type.STRING, description: "The title of the form" },
              description: { type: Type.STRING, description: "A brief description or instructions for the form" },
              questions: {
                type: Type.ARRAY,
                description: "The list of questions extracted from this page image",
                items: {
                  type: Type.OBJECT,
                  required: ["text", "type", "required"],
                  properties: {
                    text: { type: Type.STRING, description: "The question text" },
                    type: {
                      type: Type.STRING,
                      description: "The type of question",
                      enum: ["short_answer", "paragraph", "multiple_choice", "checkbox", "dropdown"]
                    },
                    options: {
                      type: Type.ARRAY,
                      description: "Options if choice-based, empty otherwise",
                      items: { type: Type.STRING }
                    },
                    required: { type: Type.BOOLEAN, description: "Whether the question is required" }
                  }
                }
              }
            }
          }
        }
      });

      const resultText = response.text;
      if (!resultText) {
        throw new Error(`لم يتم تلقي استجابة صالحة لقراءة الصفحة رقم ${index + 1}`);
      }

      const parsed = JSON.parse(resultText.trim());
      return { index, data: parsed };
    });

    const results = await Promise.all(analysisPromises);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[Server] All parallel image analyses completed in ${duration}s.`);

    // Sort results by index to preserve page order
    results.sort((a, b) => a.index - b.index);

    // Combine results
    const combinedQuestions: any[] = [];
    let combinedTitle = "";
    let combinedDescription = "";

    results.forEach((resItem, i) => {
      if (i === 0) {
        combinedTitle = resItem.data.title || "نموذج أسئلة جديد";
        combinedDescription = resItem.data.description || "تم إنشاؤه تلقائياً بواسطة تطبيق ورقتي";
      }
      if (resItem.data.questions && Array.isArray(resItem.data.questions)) {
        combinedQuestions.push(...resItem.data.questions);
      }
    });

    // Limit to 100 questions maximum
    let finalQuestions = combinedQuestions;
    if (finalQuestions.length > 100) {
      finalQuestions = finalQuestions.slice(0, 100);
    }

    const combinedResult = {
      title: combinedTitle,
      description: combinedDescription,
      questions: finalQuestions
    };

    console.log(`[Server] Combined output has ${combinedResult.questions.length} questions.`);
    res.json(combinedResult);
  } catch (error: any) {
    console.error("Error analyzing image:", error);
    res.status(500).json({ error: error.message || "حدث خطأ أثناء قراءة صورة الأسئلة." });
  }
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
