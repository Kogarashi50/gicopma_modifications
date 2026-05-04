<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('projet_maitre_ouvrage_delegue', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('projet_id');
            $table->unsignedBigInteger('maitre_ouvrage_delegue_id');
            $table->timestamps();

            $table->foreign('projet_id')->references('ID_Projet')->on('projet')->cascadeOnDelete();
            $table->foreign('maitre_ouvrage_delegue_id')->references('id')->on('maitre_ouvrage_delegue')->cascadeOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('projet_maitre_ouvrage_delegue');
    }
};
