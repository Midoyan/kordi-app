import { answerDispatchQuestion } from "@/lib/ai/dispatch";
import { dispatchQuestionRequestSchema } from "@/lib/ai/dispatch/schemas";

export async function POST(request: Request) {
  try {
    const body = dispatchQuestionRequestSchema.parse(await request.json());
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
