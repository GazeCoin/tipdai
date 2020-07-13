import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, Brackets } from "typeorm";

import { Payment } from "../payment/payment.entity";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column("text", { nullable: true })
  address!: string;

  @Column("text", { nullable: true })
  twitterId!: string;

  @Column("text", { nullable: true })
  twitterName!: string;

  @Column("text", { nullable: true })
  discordId!: string;

  @Column("text", { nullable: true })
  telegramId!: string;

  @OneToOne(type => Payment, { eager: true })
  @JoinColumn()
  cashout: Payment;

  getUsername(type?: string): string {
    switch (type) {
      case undefined: { // Return any non-null name or ID
        return this.twitterName || this.twitterId || this.discordId || this.telegramId;
      }
      case 'twitter': {
        return this.twitterName || this.twitterId;
      }
      case 'discord': {
        return this.discordId;
      }
      case 'telegram': {
        return this.telegramId;
      }
    }
    return null;
  }
}
