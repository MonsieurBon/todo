<?php

namespace DoctrineMigrations;

use Doctrine\DBAL\Migrations\AbstractMigration;
use Doctrine\DBAL\Schema\Schema;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
class Version20171009050151 extends AbstractMigration
{
    /**
     * @param Schema $schema
     */
    public function up(Schema $schema)
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->abortIf($this->connection->getDatabasePlatform()->getName() !== 'mysql', 'Migration can only be executed safely on \'mysql\'.');

        $this->addSql('CREATE TABLE tasklist_user (tasklist_id INT NOT NULL, user_id INT NOT NULL, INDEX IDX_A65DA68CFF3475DB (tasklist_id), INDEX IDX_A65DA68CA76ED395 (user_id), PRIMARY KEY(tasklist_id, user_id)) DEFAULT CHARACTER SET utf8 COLLATE utf8_unicode_ci ENGINE = InnoDB');
        $this->addSql('ALTER TABLE tasklist_user ADD CONSTRAINT FK_A65DA68CFF3475DB FOREIGN KEY (tasklist_id) REFERENCES task_list (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE tasklist_user ADD CONSTRAINT FK_A65DA68CA76ED395 FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE task_list ADD owner_id INT NOT NULL');
        $this->addSql('ALTER TABLE task_list ADD CONSTRAINT FK_377B6C637E3C61F9 FOREIGN KEY (owner_id) REFERENCES user (id)');
        $this->addSql('CREATE INDEX IDX_377B6C637E3C61F9 ON task_list (owner_id)');
        $this->addSql('UPDATE task_list SET owner_id = (SELECT id FROM `user` ORDER BY id ASC LIMIT 1)');
    }

    /**
     * @param Schema $schema
     */
    public function down(Schema $schema)
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->abortIf($this->connection->getDatabasePlatform()->getName() !== 'mysql', 'Migration can only be executed safely on \'mysql\'.');

        $this->addSql('DROP TABLE tasklist_user');
        $this->addSql('ALTER TABLE task_list DROP FOREIGN KEY FK_377B6C637E3C61F9');
        $this->addSql('DROP INDEX IDX_377B6C637E3C61F9 ON task_list');
        $this->addSql('ALTER TABLE task_list DROP owner_id');
    }
}
