import { z } from "zod";

import { answerDispatchQuestion } from "@/lib/dispatch-assistant";

const requestSchema = z.object({
  question: z.string(),
});

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    const response = await answerDispatchQuestion(body.question);

    return Response.json(response, { status: 200 });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to answer this question right now.",
      },
      { status: 500 },
    );
  }
}
