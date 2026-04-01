"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TestShell } from "../../_components/test-shell";
import { GeneralInfoSection } from "./general-info-section";
import { ImportSection } from "./import-section";
import { QuestionBankSection } from "./question-bank-section";
import { SharedLibrarySection } from "./shared-library-section";
import { SourceSelector } from "./source-selector";
import { TextbookSection } from "./textbook-section";
import {
  sharedLibraryMaterials,
  type MaterialSourceId,
} from "./material-builder-config";

export default function MaterialBuilderPageContent() {
  const [source, setSource] = useState<MaterialSourceId>("question-bank");
  const [selectedSharedMaterialId, setSelectedSharedMaterialId] = useState<string>(
    sharedLibraryMaterials[0]?.id ?? "",
  );

  return (
    <TestShell
      title="Шалгалтын материал үүсгэх"
      description="Шалгалтын ерөнхий мэдээлэл, материалын эх сурвалж, хугацааг эндээс тохируулна."
      contentClassName="bg-[#eef3ff] px-6 py-0 sm:px-8 lg:px-10"
    >
      <div className="min-h-[calc(100vh-3rem)] w-full pb-10 pt-1">
        <GeneralInfoSection />
        <SourceSelector source={source} onChange={setSource} />
        {source === "question-bank" ? <QuestionBankSection /> : null}
        {source === "import" ? <ImportSection /> : null}
        {source === "textbook" ? <TextbookSection /> : null}
        {source === "shared-library" ? (
          <SharedLibrarySection
            selectedMaterialId={selectedSharedMaterialId}
            onSelectMaterialId={setSelectedSharedMaterialId}
          />
        ) : null}

        <div className="flex items-center justify-end pt-10">
          <Button className="h-[42px] min-w-[128px] rounded-[10px] bg-[#0b5cab] px-7 text-[15px] font-semibold shadow-[0_8px_18px_rgba(11,92,171,0.25)] hover:bg-[#0a4f96]">
            {source === "shared-library"
              ? "Сонгосон материалыг ашиглах"
              : "Хадгалах"}
          </Button>
        </div>
      </div>
    </TestShell>
  );
}
