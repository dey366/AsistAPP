import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';

@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (metadata.type === 'body' && value && typeof value === 'object') {
      return this.sanitizeObject(value);
    }
    return value;
  }

  private sanitizeObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    if (obj !== null && typeof obj === 'object') {
      const sanitizedObj: any = {};
      for (const key of Object.keys(obj)) {
        sanitizedObj[key] = this.sanitizeObject(obj[key]);
      }
      return sanitizedObj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    return obj;
  }

  private sanitizeString(str: string): string {
    if (!str) return str;
    
    // Remover recursiva y proactivamente scripts, cualquier etiqueta HTML (XSS) y event listeners
    return str
      .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '') // <script>...</script>
      .replace(/<[^>]*>?/gm, '') // Cualquier tag HTML como <img>, <iframe>, etc.
      .replace(/on\w+\s*=\s*"[^"]*"/gi, '') // onclick="...", onload="..."
      .replace(/on\w+\s*=\s*'[^']*'/gi, '')
      .replace(/on\w+\s*=\s*\S+/gi, '')
      .replace(/javascript:\s*/gi, '') // javascript:alert()
      .trim();
  }
}
