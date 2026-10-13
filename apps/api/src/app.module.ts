import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { FilesModule } from './files/files.module';
import { FilesCronModule } from './files/files-cron.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    FilesModule,
    FilesCronModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
