import { SetMetadata } from '@nestjs/common';

export const COMMAND_HANDLER_METADATA = 'command:handler';

export function CommandHandler(commandName: string): ClassDecorator {
  return SetMetadata(COMMAND_HANDLER_METADATA, commandName);
}
