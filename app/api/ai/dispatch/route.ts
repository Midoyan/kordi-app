import { answerDispatchQuestion } from "@/lib/ai/dispatch";
import { dispatchDebugLog, summarizeAction } from "@/lib/ai/dispatch/debug";
import { dispatchQuestionRequestSchema } from "@/lib/ai/dispatch/schemas";

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const body = dispatchQuestionRequestSchema.parse(await request.json());
    dispatchDebugLog("api.dispatch.request", {
      question: body.question,
      questionLength: body.question.trim().length,
    });

    const response = await answerDispatchQuestion(body.question);
    dispatchDebugLog("api.dispatch.success", {
      durationMs: Date.now() - startedAt,
      answerLength: response.answer.trim().length,
      action: summarizeAction(response.action),
    });

    return Response.json(response, { status: 200 });
  } catch (error) {
    dispatchDebugLog("api.dispatch.error", {
      durationMs: Date.now() - startedAt,
      error,
    });

    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to answer this question right now.",
      },
      { status: 500 },
    );
  }
}
