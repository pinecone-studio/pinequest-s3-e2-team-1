import type { MockTest, MockTestDraft } from "@shared/contracts/mock-exam";

export type GeneratorTemplate = {
	templateId: string;
	draft: MockTestDraft;
};

export type GeneratorTestRecord = MockTest & {
	publishedAt: string | null;
};
