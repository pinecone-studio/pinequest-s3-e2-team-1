import { createYoga } from "graphql-yoga";
import { createGraphQLContext, type GraphQLContext } from "@/graphql/context";
import { schema } from "@/graphql/schema";

const yoga = createYoga<GraphQLContext>({
	schema,
	graphqlEndpoint: "/api/graphql",
	cors: {
		origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
		credentials: true,
	},
	context: createGraphQLContext,
});

export const GET = yoga;
export const POST = yoga;
export const OPTIONS = yoga;
