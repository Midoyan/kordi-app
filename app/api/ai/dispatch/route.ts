import { answerDispatchQuestion } from "@/lib/ai/dispatch";
import { dispatchDebugLog, summarizeAction } from "@/lib/ai/dispatch/debug";
import { dispatchQuestionRequestSchema } from "@/lib/ai/dispatch/schemas";
import { ZodError } from "zod";

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const body = dispatchQuestionRequestSchema.parse(await request.json());
    dispatchDebugLog("api.dispatch.request", {
      question: body.question,
      questionLength: body.question.trim().length,
      model: body.model?.trim() || null,
    });

    const response = await answerDispatchQuestion(body.question, body.model);
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

    if (error instanceof ZodError) {
      return Response.json(
        {
          error: error.message,
        },
        { status: 400 },
      );
    }

    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to answer this question right now.",
      },
      { status: 500 },
    );
  }
}
