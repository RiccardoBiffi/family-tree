declare module "virtual:embedded-demo-media" {
  interface EmbeddedDemoMedia {
    readonly base64: string;
    readonly mimeType: string;
  }

  const media: Readonly<Record<string, EmbeddedDemoMedia>>;
  export default media;
}
