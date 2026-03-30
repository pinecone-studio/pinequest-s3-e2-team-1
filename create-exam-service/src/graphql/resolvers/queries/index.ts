import { aiSchedulerQueryResolvers } from "./ai-scheduler";
import { newMathExamQueries } from "./newMathExams";
import { schoolCalendarEventQueries } from "./schoolCalendarEvents";

export const queryResolvers = {
	...newMathExamQueries,
	...aiSchedulerQueryResolvers,
	...schoolCalendarEventQueries,
};
