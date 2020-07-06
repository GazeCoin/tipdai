import {MigrationInterface, QueryRunner} from "typeorm";

export class addTelegramIdToUser1593821188207 implements MigrationInterface {
    name = 'addTelegramIdToUser1593821188207'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" ADD "telegramId" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "telegramId"`);
    }

}
