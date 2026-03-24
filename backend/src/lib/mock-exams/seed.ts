import type { GeneratorTemplate } from "@/lib/mock-exams/schema";

export const mockExamTemplates: GeneratorTemplate[] = [
  {
    templateId: "grade-10-math-algorithm-easy",
    draft: {
      title: "10-р анги Математик: Алгоритмын үндэс",
      description:
        "10-р ангийн сурагчдад зориулсан блок диаграм, дараалал, нөхцөл, давталт болон энгийн алгоритмын сэтгэлгээг хамарсан mock шалгалт.",
      criteria: {
        gradeLevel: 10,
        className: "Загвар",
        subject: "Математик",
        topic: "Явц-1",
        difficulty: "easy",
        questionCount: 8,
      },
      timeLimitMinutes: 35,
      questions: [
        {
          id: "seed-q1",
          type: "single-choice",
          prompt: "Алгоритмыг хамгийн сайн тодорхойлсон өгүүлбэр аль вэ?",
          options: [
            {
              id: "seed-q1-a",
              text: "Асуудлыг шийдэхэд ашигладаг санамсаргүй таамаглал",
            },
            {
              id: "seed-q1-b",
              text: "Асуудлыг шийдэх алхам алхмаар заасан арга",
            },
            { id: "seed-q1-c", text: "Тайланг чимэглэхэд зурдаг зураг" },
            {
              id: "seed-q1-d",
              text: "Компьютерийн хичээлд ашигладаг тооцоолуур",
            },
          ],
          correctOptionId: "seed-q1-b",
          explanation:
            "Алгоритм нь асуудлыг шийдэх эсвэл даалгавар гүйцэтгэхэд ашигладаг дараалсан зааврууд юм.",
          points: 2,
          competency: "Алгоритмын үндэс",
        },
        {
          id: "seed-q2",
          type: "single-choice",
          prompt:
            "Блок диаграмд Эхлэл эсвэл Төгсгөлийг илэрхийлэхэд ямар хэлбэр ашигладаг вэ?",
          options: [
            { id: "seed-q2-a", text: "Тэгш өнцөгт" },
            { id: "seed-q2-b", text: "Ромб" },
            { id: "seed-q2-c", text: "Зуйван" },
            { id: "seed-q2-d", text: "Сум" },
          ],
          correctOptionId: "seed-q2-c",
          explanation:
            "Блок диаграмын эхлэл болон төгсгөлийг зуйван хэлбэрээр тэмдэглэдэг.",
          points: 1,
          competency: "Блок диаграм",
        },
        {
          id: "seed-q3",
          type: "single-choice",
          prompt: "Алгоритм дахь дараалал гэдэг нь юуг хэлэх вэ?",
          options: [
            { id: "seed-q3-a", text: "Нэг алхамыг байнга давтах" },
            {
              id: "seed-q3-b",
              text: "Алхамуудыг тогтсон дарааллаар гүйцэтгэх",
            },
            { id: "seed-q3-c", text: "Олон диаграмаас сонгох" },
            { id: "seed-q3-d", text: "Оролтын алхамуудыг алгасах" },
          ],
          correctOptionId: "seed-q3-b",
          explanation:
            "Дараалал гэдэг нь заавруудыг шаардлагатай дарааллаар нэг нэгээр нь гүйцэтгэхийг хэлнэ.",
          points: 1,
          competency: "Удирдлагын бүтэц",
        },
        {
          id: "seed-q4",
          type: "single-choice",
          prompt:
            "Псевдокод дотор хоёр замын аль нэгийг сонгоход ямар бүтэц ашигладаг вэ?",
          options: [
            { id: "seed-q4-a", text: "Салаалалт" },
            { id: "seed-q4-b", text: "Оролт" },
            { id: "seed-q4-c", text: "Гаралт" },
            { id: "seed-q4-d", text: "Эрэмбэлэлт" },
          ],
          correctOptionId: "seed-q4-a",
          explanation:
            "Салаалалт нь IF/ELSE логикт ашигладаг шийдвэр гаргах бүтэц юм.",
          points: 2,
          competency: "Псевдокод",
        },
        {
          id: "seed-q5",
          type: "single-choice",
          prompt: "FOR i = 1 TO 4 давталт хэдэн удаа ажиллах вэ?",
          options: [
            { id: "seed-q5-a", text: "3 удаа" },
            { id: "seed-q5-b", text: "4 удаа" },
            { id: "seed-q5-c", text: "5 удаа" },
            { id: "seed-q5-d", text: "Огт ажиллахгүй" },
          ],
          correctOptionId: "seed-q5-b",
          explanation:
            "Утгууд нь 1, 2, 3, 4 байдаг тул давталт дөрвөн удаа ажиллана.",
          points: 2,
          competency: "Давталт",
        },
        {
          id: "seed-q6",
          type: "single-choice",
          prompt:
            "Алгоритм score >= 50 нөхцөлийг шалгахад score нь 47 бол юу болох вэ?",
          options: [
            { id: "seed-q6-a", text: "Нөхцөл үнэн болно" },
            { id: "seed-q6-b", text: "Нөхцөл худал болно" },
            { id: "seed-q6-c", text: "Компьютер үүрд зогсоно" },
            { id: "seed-q6-d", text: "Score автоматаар 50 болно" },
          ],
          correctOptionId: "seed-q6-b",
          explanation: "47 нь 50-аас бага тул нөхцөл худал гэж үнэлэгдэнэ.",
          points: 1,
          competency: "Нөхцөл",
        },
        {
          id: "seed-q7",
          type: "single-choice",
          prompt: "Өсөх дарааллаар эрэмбэлэгдсэн жагсаалт аль нь вэ?",
          options: [
            { id: "seed-q7-a", text: "9, 7, 5, 3" },
            { id: "seed-q7-b", text: "4, 6, 2, 8" },
            { id: "seed-q7-c", text: "1, 3, 5, 7" },
            { id: "seed-q7-d", text: "8, 4, 6, 2" },
          ],
          correctOptionId: "seed-q7-c",
          explanation:
            "Өсөх дараалал гэдэг нь хамгийн багаас хамгийн их рүү байрлахыг хэлнэ.",
          points: 1,
          competency: "Эрэмбэлэлтийн логик",
        },
        {
          id: "seed-q8",
          type: "single-choice",
          prompt:
            "a болон b хоёр тооны аль нь том болохыг олохын тулд ямар харьцуулалт хамгийн хэрэгтэй вэ?",
          options: [
            { id: "seed-q8-a", text: "a + b" },
            { id: "seed-q8-b", text: "a > b" },
            { id: "seed-q8-c", text: "a = b" },
            { id: "seed-q8-d", text: "a / b" },
          ],
          correctOptionId: "seed-q8-b",
          explanation:
            "a нь b-ээс том эсэхийг харьцуулснаар алгоритм том тоог тодорхойлж чадна.",
          points: 2,
          competency: "Логик харьцуулалт",
        },
      ],
    },
  },
];
