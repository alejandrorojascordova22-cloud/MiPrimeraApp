declare module 'react-native-qrcode-lite' {
  import { Component } from 'react';
  interface QRCodeProps {
    value: string;
    size?: number;
    color?: string;
    backgroundColor?: string;
    [key: string]: any;
  }
  export default class QRCode extends Component<QRCodeProps> {}
}
