import { drizzle } from "drizzle-orm/d1";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as schema from "./db/schema";

export interface Env {
  DB: D1Database;
  GEMINI_API_KEY: string;
  GEMINI_MODEL?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Зөвхөн POST /generate хүснэгтээр хандана
    if (url.pathname === "/generate" && request.method === "POST") {
      const db = getDb(env.DB);
      const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ 
        model: env.GEMINI_MODEL || "gemini-1.5-flash" 
      });

      try {
        // 1. ӨГӨГДӨЛ ТАТАХ (Сургуулийн бүх нөөц)
        // Анхаар: Хүснэгтийн нэрүүд таны схемтэй яг ижил байх ёстой
        const [allCurriculum, allGroups, allRooms, allPeriods] = await Promise.all([
          db.query.curriculum.findMany(),
          db.query.groups.findMany(),
          db.query.classrooms.findMany(),
          db.query.periods.findMany(),
        ]);

        // 2. AI PROMPT БЭЛДЭХ
        const prompt = `
          Чи бол Сургуулийн Хичээлийн Хуваарь Төлөвлөгч AI систем. 
          Доорх өгөгдөл дээр үндэслэн багш, анги, өрөөний давхцалгүй хичээлийн хуваарь зохио.

          ӨГӨГДӨЛ (JSON):
          - Төлөвлөгөө (Curriculum): ${JSON.stringify(allCurriculum)}
          - Ангиуд (Groups): ${JSON.stringify(allGroups)}
          - Өрөөнүүд (Classrooms): ${JSON.stringify(allRooms)}
          - Цаг (Periods): ${JSON.stringify(allPeriods)}

          ХАТУУ ДҮРЭМ:
          1. Нэг багш нэг цагт (periodId) зөвхөн нэг ангид (groupId) хичээл заана.
          2. Нэг өрөө (classroomId) нэг цагт зөвхөн нэг л ангид ашиглагдана.
          3. Curriculum бүрийн 'weeklyHours'-ийг 7 хоногийн (day 1-5) хооронд тарааж байрлуул.
          4. Хэрэв Curriculum-д 'requiresLab' нь true бол заавал 'LAB' төрлийн өрөө сонго.
          5. Зөвхөн JSON массив буцаа. Өөр илүү текст битгий бич.

          ГАРГАХ ҮР ДҮН (Format):
          [
            {
              "curriculumId": "uuid",
              "dayOfWeek": 1,
              "periodId": "uuid",
              "classroomId": "uuid"
            }
          ]
        `;

        // 3. AI-аас хариу авах
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const cleanJson = responseText.replace(/```json|```/g, "").trim();
        const scheduleItems = JSON.parse(cleanJson);

        // 4. БААЗ РУУ ХАДГАЛАХ (Transaction/Batch)
        // Өмнөх хуваарийг цэвэрлэх (Шинэчлэх үед)
        await db.delete(schema.masterSchedules);

        // Маш олон өгөгдлийг нэг дор хадгалах (Batch Insert)
        if (scheduleItems.length > 0) {
          // D1-ийн хязгаарлалтаас болж 50, 50-иар нь хувааж хийх нь аюулгүй
          const chunkSize = 50;
          for (let i = 0; i < scheduleItems.length; i += chunkSize) {
            const chunk = scheduleItems.slice(i, i + chunkSize);
            await db.insert(schema.masterSchedules).values(
              chunk.map((item: any) => ({
                curriculumId: item.curriculumId,
                dayOfWeek: item.dayOfWeek,
                periodId: item.periodId,
                classroomId: item.classroomId,
                isDraft: false,
              }))
            );
          }
        }

        return Response.json({ 
          success: true, 
          message: "Хуваарь амжилттай үүсэж хадгалагдлаа.",
          count: scheduleItems.length 
        });

      } catch (error: any) {
        console.error("Error generating schedule:", error);
        return Response.json({ error: error.message }, { status: 500 });
      }
    }

    return new Response("Master Scheduler Service is running. POST to /generate to start.");
  },
};