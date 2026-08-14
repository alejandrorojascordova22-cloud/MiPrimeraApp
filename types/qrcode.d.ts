declare module "qrcode" {
  type QRCodeOptions = Record<string, unknown>;

  const QRCode: {
    toString: (text: string, options?: QRCodeOptions) => Promise<string>;
    toDataURL: (text: string, options?: QRCodeOptions) => Promise<string>;
  };

  export default QRCode;
}
