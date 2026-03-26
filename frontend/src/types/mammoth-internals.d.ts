declare module "mammoth/lib/unzip" {
  const mammothUnzip: {
    openZip: (options: { buffer: Buffer }) => Promise<unknown>;
  };

  export default mammothUnzip;
}

declare module "mammoth/lib/xml" {
  const mammothXml: {
    readString: (
      xmlString: string,
      namespaceMap: Record<string, string>,
    ) => Promise<unknown>;
  };

  export default mammothXml;
}
