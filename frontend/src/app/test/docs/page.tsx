"use client";

import { useState } from "react";
import { TestShell } from "../_components/test-shell";
import { MaterialBuilderWorkspaceSection } from "./docs";
import {
  sharedLibraryMaterials,
  type MaterialSourceId,
} from "../material-builder/_components/material-builder-config";

export default function TestDocsPage() {
  const [source, setSource] = useState<MaterialSourceId>("import");
  const [selectedSharedMaterialId, setSelectedSharedMaterialId] =
    useState<string>(sharedLibraryMaterials[0]?.id ?? "");

  return (
    <TestShell
      title="Material Builder Docs"
      description="Docs доторх workspace prototype-ийг тусдаа route дээрээс шалгах хуудас."
      contentClassName="bg-[#eef3ff] px-6 py-6 sm:px-8 lg:px-10"
    >
      <div className="mx-auto w-full max-w-[1440px]">
        <MaterialBuilderWorkspaceSection
          source={source}
          onSourceChange={setSource}
          selectedSharedMaterialId={selectedSharedMaterialId}
          onSelectMaterialId={setSelectedSharedMaterialId}
        />
      </div>
    </TestShell>
  );
}
